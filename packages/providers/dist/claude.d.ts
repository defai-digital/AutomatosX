import { ExecutionRequest, ExecutionResponse } from '@ax/schemas';
import { BaseProvider } from './base.js';

/**
 * Claude Code Provider - MCP-based integration
 *
 * Integrates with Claude Code via Model Context Protocol (MCP).
 *
 * @module @ax/providers/claude
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

declare class ClaudeProvider extends BaseProvider {
    readonly id: "claude";
    readonly name = "Claude Code";
    readonly integrationMode: "mcp";
    private client;
    private transport;
    private readonly command;
    private readonly args;
    /** Promise lock to prevent concurrent initialization race conditions */
    private initPromise;
    constructor(options?: {
        command?: string;
        args?: string[];
    });
    /**
     * Initialize MCP client connection
     * Uses Promise lock to prevent race conditions with concurrent calls
     */
    initialize(): Promise<void>;
    /**
     * Internal initialization logic
     */
    private doInitialize;
    /**
     * Execute a task via Claude Code MCP
     */
    execute(request: ExecutionRequest): Promise<ExecutionResponse>;
    /**
     * Check Claude Code health via MCP ping
     */
    checkHealth(): Promise<boolean>;
    /**
     * Cleanup MCP connection
     */
    cleanup(): Promise<void>;
    /**
     * Ensure client is connected
     */
    private ensureConnected;
}

export { ClaudeProvider };
