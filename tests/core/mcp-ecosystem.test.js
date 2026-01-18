/**
 * MCP Ecosystem Domain Tests
 *
 * Tests for mcp-ecosystem domain logic:
 * - Server registry operations
 * - Tool discovery
 * - Tool routing
 * - Ecosystem manager
 *
 * Invariants tested:
 * - INV-MCP-ECO-001: Tool discovery is idempotent
 * - INV-MCP-ECO-002: Failed servers don't block others
 * - INV-MCP-ECO-003: Tool namespacing prevents collisions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMCPEcosystemManager, MCPEcosystemError, InMemoryServerRegistry, InMemoryToolRegistry, InMemoryResourceRegistry, StubMCPClientFactory, createServerRegistryService, createToolDiscoveryService, createToolRouterService, } from '@defai.digital/mcp-ecosystem';
import { MCPEcosystemErrorCodes } from '@defai.digital/contracts';
describe('MCP Ecosystem Domain', () => {
    let serverStorage;
    let toolRegistry;
    let resourceRegistry;
    let clientFactory;
    beforeEach(() => {
        serverStorage = new InMemoryServerRegistry();
        toolRegistry = new InMemoryToolRegistry();
        resourceRegistry = new InMemoryResourceRegistry();
        clientFactory = new StubMCPClientFactory();
    });
    describe('InMemoryServerRegistry', () => {
        it('should store and retrieve server configs', async () => {
            const serverState = {
                config: {
                    serverId: 'test-server',
                    name: 'Test Server',
                    command: 'node',
                    args: ['server.js'],
                    enabled: true,
                    connectionTimeoutMs: 10000,
                    requestTimeoutMs: 60000,
                    maxRetries: 3,
                },
                status: 'disconnected',
                toolCount: 0,
                resourceCount: 0,
            };
            await serverStorage.set('test-server', serverState);
            const retrieved = await serverStorage.get('test-server');
            expect(retrieved?.config.serverId).toBe('test-server');
        });
        it('should list servers with filtering', async () => {
            await serverStorage.set('server-a', {
                config: {
                    serverId: 'server-a',
                    name: 'Server A',
                    command: 'a',
                    enabled: true,
                    connectionTimeoutMs: 10000,
                    requestTimeoutMs: 60000,
                    maxRetries: 3,
                },
                status: 'disconnected',
                toolCount: 0,
                resourceCount: 0,
            });
            await serverStorage.set('server-b', {
                config: {
                    serverId: 'server-b',
                    name: 'Server B',
                    command: 'b',
                    enabled: false,
                    connectionTimeoutMs: 10000,
                    requestTimeoutMs: 60000,
                    maxRetries: 3,
                },
                status: 'disabled',
                toolCount: 0,
                resourceCount: 0,
            });
            const all = await serverStorage.list({ limit: 10, offset: 0 });
            expect(all.servers).toHaveLength(2);
            const enabled = await serverStorage.list({ limit: 10, offset: 0, enabled: true });
            expect(enabled.servers).toHaveLength(1);
            expect(enabled.servers[0].config.serverId).toBe('server-a');
        });
        it('should delete servers', async () => {
            await serverStorage.set('test', {
                config: {
                    serverId: 'test',
                    name: 'Test',
                    command: 'test',
                    enabled: true,
                    connectionTimeoutMs: 10000,
                    requestTimeoutMs: 60000,
                    maxRetries: 3,
                },
                status: 'disconnected',
                toolCount: 0,
                resourceCount: 0,
            });
            const deleted = await serverStorage.delete('test');
            expect(deleted).toBe(true);
            const retrieved = await serverStorage.get('test');
            expect(retrieved).toBeNull();
        });
        it('should return false when deleting non-existent server', async () => {
            const deleted = await serverStorage.delete('non-existent');
            expect(deleted).toBe(false);
        });
    });
    describe('InMemoryToolRegistry', () => {
        it('should store and retrieve tools', async () => {
            await toolRegistry.setTools('server-1', [
                {
                    toolName: 'tool1',
                    serverId: 'server-1',
                    fullName: 'server-1.tool1',
                    description: 'Tool 1',
                    inputSchema: {},
                },
                {
                    toolName: 'tool2',
                    serverId: 'server-1',
                    fullName: 'server-1.tool2',
                    description: 'Tool 2',
                    inputSchema: {},
                },
            ]);
            const tools = await toolRegistry.getTools('server-1');
            expect(tools).toHaveLength(2);
        });
        it('should get all tools across servers', async () => {
            await toolRegistry.setTools('server-1', [
                {
                    toolName: 'tool1',
                    serverId: 'server-1',
                    fullName: 'server-1.tool1',
                    description: 'Tool 1',
                    inputSchema: {},
                },
            ]);
            await toolRegistry.setTools('server-2', [
                {
                    toolName: 'tool2',
                    serverId: 'server-2',
                    fullName: 'server-2.tool2',
                    description: 'Tool 2',
                    inputSchema: {},
                },
            ]);
            const allTools = await toolRegistry.getAllTools();
            expect(allTools).toHaveLength(2);
        });
        it('should find tools by name', async () => {
            await toolRegistry.setTools('server-1', [
                {
                    toolName: 'search',
                    serverId: 'server-1',
                    fullName: 'server-1.search',
                    description: 'Search 1',
                    inputSchema: {},
                },
            ]);
            await toolRegistry.setTools('server-2', [
                {
                    toolName: 'search',
                    serverId: 'server-2',
                    fullName: 'server-2.search',
                    description: 'Search 2',
                    inputSchema: {},
                },
            ]);
            const tools = await toolRegistry.findTool('search');
            expect(tools).toHaveLength(2);
        });
        // INV-MCP-ECO-003: Tool namespacing prevents collisions
        it('should find tools by full name for disambiguation', async () => {
            await toolRegistry.setTools('server-1', [
                {
                    toolName: 'search',
                    serverId: 'server-1',
                    fullName: 'server-1.search',
                    description: 'Search 1',
                    inputSchema: {},
                },
            ]);
            await toolRegistry.setTools('server-2', [
                {
                    toolName: 'search',
                    serverId: 'server-2',
                    fullName: 'server-2.search',
                    description: 'Search 2',
                    inputSchema: {},
                },
            ]);
            const tool = await toolRegistry.getToolByFullName('server-1.search');
            expect(tool).not.toBeNull();
            expect(tool?.serverId).toBe('server-1');
        });
        it('should clear tools for a server', async () => {
            await toolRegistry.setTools('server-1', [
                {
                    toolName: 'tool1',
                    serverId: 'server-1',
                    fullName: 'server-1.tool1',
                    description: 'Tool 1',
                    inputSchema: {},
                },
            ]);
            await toolRegistry.clearTools('server-1');
            const tools = await toolRegistry.getTools('server-1');
            expect(tools).toHaveLength(0);
        });
    });
    describe('InMemoryResourceRegistry', () => {
        it('should store and retrieve resources', async () => {
            await resourceRegistry.setResources('server-1', [
                {
                    uri: 'file:///path/to/file',
                    serverId: 'server-1',
                    name: 'Config File',
                    mimeType: 'application/json',
                },
            ]);
            const resources = await resourceRegistry.getResources('server-1');
            expect(resources).toHaveLength(1);
        });
        it('should find resource by URI', async () => {
            await resourceRegistry.setResources('server-1', [
                {
                    uri: 'file:///path/to/file',
                    serverId: 'server-1',
                    name: 'Config File',
                    mimeType: 'application/json',
                },
            ]);
            const resource = await resourceRegistry.getResourceByUri('server-1', 'file:///path/to/file');
            expect(resource).not.toBeNull();
            expect(resource?.name).toBe('Config File');
        });
    });
    describe('StubMCPClientFactory', () => {
        it('should create stub clients', () => {
            const client = clientFactory.createClient();
            expect(client).toBeDefined();
        });
        it('should return same client on subsequent calls', () => {
            const client1 = clientFactory.createClient();
            const client2 = clientFactory.createClient();
            expect(client1).toBe(client2);
        });
        it('stub client should simulate connection', async () => {
            const client = clientFactory.createClient();
            expect(client.isConnected()).toBe(false);
            await client.connect({
                serverId: 'test',
                name: 'Test',
                command: 'test',
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            expect(client.isConnected()).toBe(true);
        });
        it('stub client should list tools', async () => {
            const client = clientFactory.createClient();
            await client.connect({
                serverId: 'test',
                name: 'Test',
                command: 'test',
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const tools = await client.listTools();
            expect(Array.isArray(tools)).toBe(true);
        });
    });
    describe('Server Registry Service', () => {
        it('should register new servers', async () => {
            const service = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            const result = await service.register({
                serverId: 'new-server',
                name: 'New Server',
                command: 'node',
                args: ['server.js'],
                connectNow: false,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            expect(result.success).toBe(true);
            expect(result.created).toBe(true);
        });
        it('should update existing servers', async () => {
            const service = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            await service.register({
                serverId: 'server',
                name: 'Server',
                command: 'node',
                connectNow: false,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const result = await service.register({
                serverId: 'server',
                name: 'Updated Server',
                command: 'updated-command',
                connectNow: false,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            expect(result.success).toBe(true);
            expect(result.created).toBe(false);
        });
        it('should connect to server on registration', async () => {
            const service = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            const result = await service.register({
                serverId: 'server',
                name: 'Server',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            expect(result.success).toBe(true);
            // The stub client connects, so status should be connected
            expect(result.server?.status).toBe('connected');
        });
        it('should list servers', async () => {
            const service = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            await service.register({
                serverId: 'server-1',
                name: 'Server 1',
                command: 'test',
                connectNow: false,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            await service.register({
                serverId: 'server-2',
                name: 'Server 2',
                command: 'test',
                connectNow: false,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const result = await service.list({ limit: 10, offset: 0 });
            expect(result.total).toBe(2);
            expect(result.servers).toHaveLength(2);
        });
        it('should unregister servers', async () => {
            const service = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            await service.register({
                serverId: 'server',
                name: 'Server',
                command: 'test',
                connectNow: false,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const unregistered = await service.unregister('server');
            expect(unregistered).toBe(true);
            const server = await service.get('server');
            expect(server).toBeNull();
        });
    });
    describe('Tool Discovery Service', () => {
        it('should discover tools from connected server', async () => {
            const serverService = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            await serverService.register({
                serverId: 'test-server',
                name: 'Test Server',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const discoveryService = createToolDiscoveryService({
                serverRegistry: serverService,
                toolRegistry,
                resourceRegistry,
                serverStorage,
            });
            const result = await discoveryService.discover({ forceRefresh: false, includeDisabled: false });
            expect(result.serverResults).toHaveLength(1);
            expect(result.serverResults[0].serverId).toBe('test-server');
        });
        // INV-MCP-ECO-001: Tool discovery is idempotent
        it('should return same results on repeated discovery', async () => {
            const serverService = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            await serverService.register({
                serverId: 'test-server',
                name: 'Test Server',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const discoveryService = createToolDiscoveryService({
                serverRegistry: serverService,
                toolRegistry,
                resourceRegistry,
                serverStorage,
            });
            const result1 = await discoveryService.discover({ forceRefresh: false, includeDisabled: false });
            const result2 = await discoveryService.discover({ forceRefresh: false, includeDisabled: false });
            expect(result1.tools.length).toBe(result2.tools.length);
            expect(result1.resources.length).toBe(result2.resources.length);
        });
        // INV-MCP-ECO-002: Failed servers don't block others
        it('should continue discovery when one server fails', async () => {
            const serverService = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            // Register two servers
            await serverService.register({
                serverId: 'server-one',
                name: 'Server One',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            await serverService.register({
                serverId: 'server-two',
                name: 'Server Two',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const discoveryService = createToolDiscoveryService({
                serverRegistry: serverService,
                toolRegistry,
                resourceRegistry,
                serverStorage,
            });
            const result = await discoveryService.discover({
                serverIds: ['server-one', 'server-two'],
                forceRefresh: false,
                includeDisabled: false,
            });
            // INV-MCP-ECO-002: Both servers should report independently
            expect(result.serverResults).toHaveLength(2);
            // Both servers succeed with stub client - verifies parallel discovery works
            const serverOneResult = result.serverResults.find((r) => r.serverId === 'server-one');
            expect(serverOneResult?.status).toBe('success');
            const serverTwoResult = result.serverResults.find((r) => r.serverId === 'server-two');
            expect(serverTwoResult?.status).toBe('success');
        });
        // INV-MCP-ECO-002: Error handling - non-existent server returns error status
        it('should return error status for non-existent servers', async () => {
            const serverService = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            // Register one valid server
            await serverService.register({
                serverId: 'valid-server',
                name: 'Valid Server',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const discoveryService = createToolDiscoveryService({
                serverRegistry: serverService,
                toolRegistry,
                resourceRegistry,
                serverStorage,
            });
            // Discover from valid server and a non-existent one
            const result = await discoveryService.discover({
                serverIds: ['valid-server', 'non-existent-server'],
                forceRefresh: false,
                includeDisabled: false,
            });
            // Should have results for both servers
            expect(result.serverResults).toHaveLength(2);
            // Valid server should succeed
            const validResult = result.serverResults.find((r) => r.serverId === 'valid-server');
            expect(validResult?.status).toBe('success');
            // Non-existent server should have error status
            const nonExistentResult = result.serverResults.find((r) => r.serverId === 'non-existent-server');
            expect(nonExistentResult?.status).toBe('error');
            expect(nonExistentResult?.error).toBe('Server not found');
        });
    });
    describe('Tool Router Service', () => {
        it('should resolve unique tool names', async () => {
            const serverService = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            await serverService.register({
                serverId: 'test-server',
                name: 'Test Server',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const discoveryService = createToolDiscoveryService({
                serverRegistry: serverService,
                toolRegistry,
                resourceRegistry,
                serverStorage,
            });
            await discoveryService.discover({ forceRefresh: false, includeDisabled: false });
            // Manually add a tool for testing
            await toolRegistry.setTools('test-server', [
                {
                    toolName: 'unique_tool',
                    serverId: 'test-server',
                    fullName: 'test-server.unique_tool',
                    description: 'A unique tool',
                    inputSchema: {},
                },
            ]);
            const routerService = createToolRouterService({
                serverRegistry: serverService,
                toolDiscovery: discoveryService,
                defaultRequestTimeoutMs: 60000,
            });
            const tool = await routerService.resolveTool('unique_tool');
            expect(tool).not.toBeNull();
            expect(tool?.toolName).toBe('unique_tool');
        });
        // INV-MCP-ECO-003: Tool namespacing prevents collisions
        it('should resolve tools by full name when ambiguous', async () => {
            const serverService = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            await serverService.register({
                serverId: 'server-a',
                name: 'Server A',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            await serverService.register({
                serverId: 'server-b',
                name: 'Server B',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const discoveryService = createToolDiscoveryService({
                serverRegistry: serverService,
                toolRegistry,
                resourceRegistry,
                serverStorage,
            });
            // Add same tool name to both servers
            await toolRegistry.setTools('server-a', [
                {
                    toolName: 'search',
                    serverId: 'server-a',
                    fullName: 'server-a.search',
                    description: 'Search A',
                    inputSchema: {},
                },
            ]);
            await toolRegistry.setTools('server-b', [
                {
                    toolName: 'search',
                    serverId: 'server-b',
                    fullName: 'server-b.search',
                    description: 'Search B',
                    inputSchema: {},
                },
            ]);
            const routerService = createToolRouterService({
                serverRegistry: serverService,
                toolDiscovery: discoveryService,
                defaultRequestTimeoutMs: 60000,
            });
            // Should resolve by full name
            const toolA = await routerService.resolveTool('server-a.search');
            expect(toolA?.serverId).toBe('server-a');
            const toolB = await routerService.resolveTool('server-b.search');
            expect(toolB?.serverId).toBe('server-b');
        });
        it('should invoke tools', async () => {
            const serverService = createServerRegistryService({
                storage: serverStorage,
                clientFactory,
                defaultConnectionTimeoutMs: 10000,
            });
            await serverService.register({
                serverId: 'test-server',
                name: 'Test Server',
                command: 'node',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const discoveryService = createToolDiscoveryService({
                serverRegistry: serverService,
                toolRegistry,
                resourceRegistry,
                serverStorage,
            });
            await toolRegistry.setTools('test-server', [
                {
                    toolName: 'test_tool',
                    serverId: 'test-server',
                    fullName: 'test-server.test_tool',
                    description: 'Test tool',
                    inputSchema: {},
                    available: true,
                },
            ]);
            const routerService = createToolRouterService({
                serverRegistry: serverService,
                toolDiscovery: discoveryService,
                defaultRequestTimeoutMs: 60000,
            });
            const result = await routerService.invoke({
                toolName: 'test_tool',
                arguments: { input: 'test' },
            });
            // Response returns fullName for unambiguous identification
            expect(result.toolName).toBe('test-server.test_tool');
            expect(result.serverId).toBe('test-server');
        });
    });
    describe('MCP Ecosystem Manager', () => {
        it('should register and discover servers', async () => {
            const manager = createMCPEcosystemManager({
                serverRegistry: serverStorage,
                toolRegistry,
                resourceRegistry,
                clientFactory,
            });
            const registerResult = await manager.registerServer({
                serverId: 'test-server',
                name: 'Test Server',
                command: 'node',
                args: ['server.js'],
                connectNow: true,
                discoverNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            expect(registerResult.success).toBe(true);
            expect(registerResult.server?.status).toBe('connected');
        });
        it('should list servers', async () => {
            const manager = createMCPEcosystemManager({
                serverRegistry: serverStorage,
                toolRegistry,
                resourceRegistry,
                clientFactory,
            });
            await manager.registerServer({
                serverId: 'server-1',
                name: 'Server 1',
                command: 'test',
                connectNow: false,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            await manager.registerServer({
                serverId: 'server-2',
                name: 'Server 2',
                command: 'test',
                connectNow: false,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const result = await manager.listServers();
            expect(result.total).toBe(2);
        });
        it('should unregister servers and clear tools', async () => {
            const manager = createMCPEcosystemManager({
                serverRegistry: serverStorage,
                toolRegistry,
                resourceRegistry,
                clientFactory,
            });
            await manager.registerServer({
                serverId: 'server',
                name: 'Server',
                command: 'test',
                connectNow: true,
                discoverNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            // Add some tools
            await toolRegistry.setTools('server', [
                {
                    toolName: 'tool1',
                    serverId: 'server',
                    fullName: 'server.tool1',
                    description: 'Tool',
                    inputSchema: {},
                },
            ]);
            const unregistered = await manager.unregisterServer('server');
            expect(unregistered).toBe(true);
            // Tools should be cleared
            const tools = await toolRegistry.getTools('server');
            expect(tools).toHaveLength(0);
        });
        it('should discover tools across servers', async () => {
            const manager = createMCPEcosystemManager({
                serverRegistry: serverStorage,
                toolRegistry,
                resourceRegistry,
                clientFactory,
            });
            await manager.registerServer({
                serverId: 'server-1',
                name: 'Server 1',
                command: 'test',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            await manager.registerServer({
                serverId: 'server-2',
                name: 'Server 2',
                command: 'test',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            const result = await manager.discover({});
            expect(result.serverResults).toHaveLength(2);
        });
        it('should invoke tools', async () => {
            const manager = createMCPEcosystemManager({
                serverRegistry: serverStorage,
                toolRegistry,
                resourceRegistry,
                clientFactory,
            });
            await manager.registerServer({
                serverId: 'test-server',
                name: 'Test Server',
                command: 'test',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            // Add a tool
            await toolRegistry.setTools('test-server', [
                {
                    toolName: 'invoke_test',
                    serverId: 'test-server',
                    fullName: 'test-server.invoke_test',
                    description: 'Test invocation',
                    inputSchema: {},
                    available: true,
                },
            ]);
            const result = await manager.invokeTool({
                toolName: 'invoke_test',
                arguments: { test: true },
            });
            // Response returns fullName for unambiguous identification
            expect(result.toolName).toBe('test-server.invoke_test');
            expect(result.serverId).toBe('test-server');
        });
        it('should get tools for specific server', async () => {
            const manager = createMCPEcosystemManager({
                serverRegistry: serverStorage,
                toolRegistry,
                resourceRegistry,
                clientFactory,
            });
            await manager.registerServer({
                serverId: 'server-1',
                name: 'Server 1',
                command: 'test',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            await toolRegistry.setTools('server-1', [
                {
                    toolName: 'tool1',
                    serverId: 'server-1',
                    fullName: 'server-1.tool1',
                    description: 'Tool 1',
                    inputSchema: {},
                },
                {
                    toolName: 'tool2',
                    serverId: 'server-1',
                    fullName: 'server-1.tool2',
                    description: 'Tool 2',
                    inputSchema: {},
                },
            ]);
            const tools = await manager.getTools('server-1');
            expect(tools).toHaveLength(2);
        });
        it('should get all tools when no server specified', async () => {
            const manager = createMCPEcosystemManager({
                serverRegistry: serverStorage,
                toolRegistry,
                resourceRegistry,
                clientFactory,
            });
            await toolRegistry.setTools('server-1', [
                {
                    toolName: 'tool1',
                    serverId: 'server-1',
                    fullName: 'server-1.tool1',
                    description: 'Tool 1',
                    inputSchema: {},
                },
            ]);
            await toolRegistry.setTools('server-2', [
                {
                    toolName: 'tool2',
                    serverId: 'server-2',
                    fullName: 'server-2.tool2',
                    description: 'Tool 2',
                    inputSchema: {},
                },
            ]);
            const tools = await manager.getTools();
            expect(tools).toHaveLength(2);
        });
        it('should find tool by name', async () => {
            const manager = createMCPEcosystemManager({
                serverRegistry: serverStorage,
                toolRegistry,
                resourceRegistry,
                clientFactory,
            });
            await manager.registerServer({
                serverId: 'server',
                name: 'Server',
                command: 'test',
                connectNow: true,
                enabled: true,
                connectionTimeoutMs: 10000,
                requestTimeoutMs: 60000,
                maxRetries: 3,
            });
            await toolRegistry.setTools('server', [
                {
                    toolName: 'find_me',
                    serverId: 'server',
                    fullName: 'server.find_me',
                    description: 'Find this tool',
                    inputSchema: {},
                    available: true,
                },
            ]);
            const tool = await manager.findTool('find_me');
            expect(tool).not.toBeNull();
            expect(tool?.toolName).toBe('find_me');
        });
    });
    describe('MCPEcosystemError', () => {
        it('should create server not found error', () => {
            const error = MCPEcosystemError.serverNotFound('test-server');
            expect(error.code).toBe(MCPEcosystemErrorCodes.SERVER_NOT_FOUND);
            expect(error.message).toContain('test-server');
            expect(error.details?.serverId).toBe('test-server');
        });
        it('should create tool not found error', () => {
            const error = MCPEcosystemError.toolNotFound('unknown_tool');
            expect(error.code).toBe(MCPEcosystemErrorCodes.TOOL_NOT_FOUND);
            expect(error.message).toContain('unknown_tool');
        });
        it('should create ambiguous tool error', () => {
            const error = MCPEcosystemError.ambiguousTool('search', [
                'server-a.search',
                'server-b.search',
            ]);
            expect(error.code).toBe(MCPEcosystemErrorCodes.AMBIGUOUS_TOOL);
            expect(error.message).toContain('search');
            expect(error.details?.matches).toContain('server-a.search');
        });
    });
});
//# sourceMappingURL=mcp-ecosystem.test.js.map