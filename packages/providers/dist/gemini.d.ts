import { ExecutionRequest, ExecutionResponse } from '@ax/schemas';
import { BaseProvider } from './base.js';

/**
 * Gemini CLI Provider - MCP-based integration
 *
 * Integrates with Gemini CLI via Model Context Protocol (MCP).
 *
 * @module @ax/providers/gemini
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

declare class GeminiProvider extends BaseProvider {
    readonly id: "gemini";
    readonly name = "Gemini CLI";
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
     * Execute a task via Gemini CLI MCP
     */
    execute(request: ExecutionRequest): Promise<ExecutionResponse>;
    /**
     * Check Gemini CLI health via MCP ping
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

export { GeminiProvider };
