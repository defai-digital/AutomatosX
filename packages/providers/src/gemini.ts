/**
 * Gemini CLI Provider - MCP-based integration
 *
 * Integrates with Gemini CLI via Model Context Protocol (MCP).
 *
 * @module @ax/providers/gemini
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// MCP Client Constants
// =============================================================================

/** MCP client identification */
const MCP_CLIENT_NAME = 'automatosx';
const MCP_CLIENT_VERSION = '11.0.0';

/** Default command and args for Gemini CLI */
const DEFAULT_COMMAND = 'gemini';
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
// Gemini Provider
// =============================================================================

export class GeminiProvider extends BaseProvider {
  readonly id = 'gemini' as const;
  readonly name = 'Gemini CLI';
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
    if (this.client) {
      return; // Already initialized
    }

    // Reuse existing initialization promise if in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
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
   * Execute a task via Gemini CLI MCP
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const start = Date.now();

    try {
      await this.ensureConnected();

      if (!this.client) {
        return this.createErrorResponse(
          request,
          ERROR_CODE_NOT_CONNECTED,
          'Gemini MCP client not connected',
          true
        );
      }

      // Call the run_task tool via MCP (standardized tool name across providers)
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
   * Check Gemini CLI health via MCP ping
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.ensureConnected();

      if (!this.client) {
        return false;
      }

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
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    // Call base cleanup to clear recovery timeout
    await super.cleanup();
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
