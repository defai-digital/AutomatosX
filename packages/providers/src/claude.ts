/**
 * Claude Code Provider - MCP-based integration
 *
 * Integrates with Claude Code via Model Context Protocol (MCP).
 *
 * @module @ax/providers/claude
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// MCP Client Constants
// =============================================================================

/** MCP client identification */
const MCP_CLIENT_NAME = 'automatosx';
const MCP_CLIENT_VERSION = '11.0.0';

/** Default command and args for Claude CLI */
const DEFAULT_COMMAND = 'claude';
const DEFAULT_ARGS = ['mcp'];

/** MCP tool name for task execution */
const MCP_TOOL_NAME = 'run_task';

/** Error codes */
const ERROR_CODE_NOT_CONNECTED = 'NOT_CONNECTED';
const ERROR_CODE_MCP_ERROR = 'MCP_ERROR';

// =============================================================================
// Imports
// =============================================================================

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { type ExecutionRequest, type ExecutionResponse } from '@ax/schemas';
import { BaseProvider } from './base.js';

// =============================================================================
// Claude Provider
// =============================================================================

export class ClaudeProvider extends BaseProvider {
  readonly id = 'claude' as const;
  readonly name = 'Claude Code';
  readonly integrationMode = 'mcp' as const;

  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private readonly command: string;
  private readonly args: string[];
  /** Promise lock to prevent concurrent initialization race conditions */
  private initPromise: Promise<void> | null = null;

  constructor(options?: { command?: string; args?: string[] }) {
    super();
    this.command = options?.command ?? DEFAULT_COMMAND;
    this.args = options?.args ?? DEFAULT_ARGS;
  }

  /**
   * Initialize MCP client connection
   * Uses Promise lock to prevent race conditions with concurrent calls
   */
  override async initialize(): Promise<void> {
    // Already initialized - return immediately
    if (this.client) {
      return;
    }

    // Reuse existing initialization promise if in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Create and store the initialization promise
    // Note: We don't clear initPromise on success to prevent re-initialization
    // It's only cleared on failure so retry is possible
    this.initPromise = this.doInitialize();
    try {
      await this.initPromise;
    } catch (error) {
      // Clear promise on failure to allow retry
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Internal initialization logic
   */
  private async doInitialize(): Promise<void> {
    // Double-check after acquiring lock
    if (this.client) {
      return;
    }

    this.transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
    });

    this.client = new Client(
      {
        name: MCP_CLIENT_NAME,
        version: MCP_CLIENT_VERSION,
      },
      {
        capabilities: {},
      }
    );

    try {
      await this.client.connect(this.transport);
    } catch (error) {
      // Cleanup resources on connection failure to prevent leaks
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
      this.client = null;
      throw error;
    }
  }

  /**
   * Execute a task via Claude Code MCP
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const start = Date.now();

    try {
      await this.ensureConnected();

      if (!this.client) {
        return this.createErrorResponse(
          request,
          ERROR_CODE_NOT_CONNECTED,
          'Claude MCP client not connected',
          true
        );
      }

      // Call the run_task tool via MCP
      const result = await this.client.callTool({
        name: MCP_TOOL_NAME,
        arguments: {
          task: request.task,
          agent: request.agent,
          timeout: request.timeout,
        },
      });

      const duration = Date.now() - start;

      // Extract output from MCP response (uses shared BaseProvider method)
      const output = this.extractMcpOutput(result);

      return this.createSuccessResponse(output, duration);
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';

      return this.createErrorResponse(request, ERROR_CODE_MCP_ERROR, message, true);
    }
  }

  /**
   * Check Claude Code health via MCP ping
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.ensureConnected();

      if (!this.client) {
        return false;
      }

      // Use ping to check connection
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup MCP connection
   */
  override async cleanup(): Promise<void> {
    // Use try-finally to ensure transport is always closed even if client.close() throws
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
    } finally {
      if (this.transport) {
        try {
          await this.transport.close();
        } catch (error) {
          console.warn(
            `[ax/claude] Failed to close transport: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
        this.transport = null;
      }
      // Clear init promise to allow re-initialization after cleanup
      this.initPromise = null;
      // Call base cleanup to clear recovery timeout and reset health
      await super.cleanup();
    }
  }

  /**
   * Ensure client is connected
   */
  private async ensureConnected(): Promise<void> {
    if (!this.client) {
      await this.initialize();
    }
  }
}
