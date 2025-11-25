import { ExecutionRequest, ExecutionResponse } from '@ax/schemas';
import { BaseProvider } from './base.js';

/**
 * OpenAI Codex Provider - Bash-based integration
 *
 * Integrates with OpenAI Codex via process spawning (bash mode).
 * Using bash mode because OpenAI's MCP implementation has known bugs.
 *
 * @module @ax/providers/openai
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

declare class OpenAIProvider extends BaseProvider {
    readonly id: "openai";
    readonly name = "OpenAI Codex";
    readonly integrationMode: "bash";
    private readonly command;
    private readonly defaultArgs;
    private activeProcess;
    constructor(options?: {
        command?: string;
        args?: string[];
    });
    /**
     * Execute a task via OpenAI Codex CLI
     */
    execute(request: ExecutionRequest): Promise<ExecutionResponse>;
    /**
     * Check OpenAI Codex CLI availability
     */
    checkHealth(): Promise<boolean>;
    /**
     * Cleanup any active processes
     */
    cleanup(): Promise<void>;
    /**
     * Run a command via subprocess
     */
    private runCommand;
}

export { OpenAIProvider };
