import { Config, MemoryManager, SessionManager, ProviderRouter, AgentRegistry, AgentExecutor } from '@ax/core';

/**
 * MCP Types
 *
 * Type definitions for the MCP server.
 *
 * @module @ax/mcp/types
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
interface ToolHandler {
    definition: ToolDefinition;
    execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}
interface ToolResult {
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}
interface ServerConfig {
    name: string;
    version: string;
    basePath?: string | undefined;
}
interface ServerCapabilities {
    tools?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    prompts?: {
        listChanged?: boolean;
    };
}
interface ListToolsResponse {
    tools: ToolDefinition[];
}
interface CallToolRequest {
    name: string;
    arguments?: Record<string, unknown>;
}
interface CallToolResponse {
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}

/**
 * MCP Server Implementation
 *
 * The core MCP server that handles tool registration and execution.
 *
 * @module @ax/mcp/mcp-server
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

declare class AutomatosXServer {
    private server;
    private tools;
    private config;
    constructor(config?: Partial<ServerConfig>);
    private getCapabilities;
    private registerTools;
    private addTool;
    private setupHandlers;
    start(): Promise<void>;
    stop(): Promise<void>;
    getToolCount(): number;
    getToolNames(): string[];
}
declare function createServer(config?: Partial<ServerConfig>): AutomatosXServer;

/**
 * MCP Context
 *
 * Shared context for MCP tools, providing access to core services.
 *
 * @module @ax/mcp/tools/context
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

interface CLIContext {
    config: Config;
    configPath: string | null;
    basePath: string;
    memoryManager: MemoryManager;
    sessionManager: SessionManager;
    providerRouter: ProviderRouter;
    agentRegistry: AgentRegistry;
    agentExecutor: AgentExecutor;
}
/**
 * Initialize and get MCP context
 */
declare function getContext(): Promise<CLIContext>;
/**
 * Cleanup context resources
 */
declare function cleanupContext(): Promise<void>;

/**
 * Agent Tools
 *
 * MCP tools for agent operations.
 *
 * @module @ax/mcp/tools/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

declare function createRunTool(getContext: () => Promise<CLIContext>): ToolHandler;
declare function createListAgentsTool(getContext: () => Promise<CLIContext>): ToolHandler;
declare function createAgentInfoTool(getContext: () => Promise<CLIContext>): ToolHandler;

/**
 * Memory Tools
 *
 * MCP tools for memory operations.
 *
 * @module @ax/mcp/tools/memory
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

declare function createMemorySearchTool(getContext: () => Promise<CLIContext>): ToolHandler;
declare function createMemorySaveTool(getContext: () => Promise<CLIContext>): ToolHandler;
declare function createMemoryStatsTool(getContext: () => Promise<CLIContext>): ToolHandler;

/**
 * Session Tools
 *
 * MCP tools for session management.
 *
 * @module @ax/mcp/tools/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

declare function createSessionCreateTool(getContext: () => Promise<CLIContext>): ToolHandler;
declare function createSessionListTool(getContext: () => Promise<CLIContext>): ToolHandler;
declare function createSessionInfoTool(getContext: () => Promise<CLIContext>): ToolHandler;

/**
 * System Tools
 *
 * MCP tools for system status and configuration.
 *
 * @module @ax/mcp/tools/system
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

declare function createStatusTool(getContext: () => Promise<CLIContext>): ToolHandler;
declare function createProviderStatusTool(getContext: () => Promise<CLIContext>): ToolHandler;
declare function createConfigTool(getContext: () => Promise<CLIContext>): ToolHandler;

export { AutomatosXServer, type CallToolRequest, type CallToolResponse, type ListToolsResponse, type ServerCapabilities, type ServerConfig, type ToolDefinition, type ToolHandler, type ToolResult, cleanupContext, createAgentInfoTool, createConfigTool, createListAgentsTool, createMemorySaveTool, createMemorySearchTool, createMemoryStatsTool, createProviderStatusTool, createRunTool, createServer, createSessionCreateTool, createSessionInfoTool, createSessionListTool, createStatusTool, getContext };
