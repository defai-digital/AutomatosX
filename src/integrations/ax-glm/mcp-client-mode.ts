/**
 * ax-glm MCP Client Mode
 *
 * Enables ax-glm to connect to AutomatosX MCP server for:
 * - Service discovery (agents, tools, capabilities)
 * - Memory search and persistence
 * - Smart routing context retrieval
 *
 * v13.0.0: Added as part of PRD MCP Architecture Redesign.
 *
 * @module integrations/ax-glm/mcp-client-mode
 */

import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../../shared/logging/logger.js';
import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { GLMSdkAdapter } from './sdk-adapter.js';
import type { GLMModel } from './types.js';

/**
 * MCP JSON-RPC types
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  id: number;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

interface McpToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Chat options for ax-glm with MCP integration
 */
export interface GlmMcpChatOptions {
  /** Agent to use (loads context from AutomatosX) */
  agent?: string;
  /** Model to use (default: glm-4) */
  model?: string;
  /** Include memory context */
  includeMemory?: boolean;
  /** Max memory results to include */
  maxMemoryResults?: number;
  /** Save response to memory */
  saveToMemory?: boolean;
}

/**
 * Agent info from list_agents
 */
export interface AgentInfo {
  name: string;
  displayName?: string;
  role?: string;
  description?: string;
  team?: string;
  abilities?: string[];
}

/**
 * Memory entry from search_memory
 */
export interface MemoryEntry {
  id: number;
  content: string;
  relevance: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Agent context from get_agent_context
 */
export interface AgentContext {
  agent: string;
  profile: {
    name: string;
    displayName?: string;
    role?: string;
    systemPrompt?: string;
  };
  memory: MemoryEntry[];
  enhancedPrompt: string;
}

/**
 * ax-glm with MCP client integration
 *
 * Connects to AutomatosX MCP server for orchestration while using
 * GLM SDK directly for execution (no CLI indirection).
 *
 * **Usage:**
 * ```typescript
 * const glm = new AxGlmWithMcp();
 * await glm.connect();
 *
 * // Discover agents
 * const agents = await glm.listAgents();
 *
 * // Chat with agent context
 * const response = await glm.chat('Implement user auth', {
 *   agent: 'backend',
 *   saveToMemory: true
 * });
 * ```
 */
export class AxGlmWithMcp {
  private mcpProcess: ChildProcess | null = null;
  private glmSdk: GLMSdkAdapter;
  private connected = false;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private responseBuffer = '';

  constructor(options: { model?: GLMModel; apiKey?: string } = {}) {
    this.glmSdk = new GLMSdkAdapter({
      model: options.model,
      apiKey: options.apiKey
    });
  }

  /**
   * Connect to AutomatosX MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info('[ax-glm MCP] Connecting to AutomatosX MCP server...');

    // Spawn MCP server process
    this.mcpProcess = spawn('automatosx', ['mcp', 'server'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Set up response handling
    this.mcpProcess.stdout?.on('data', (data: Buffer) => {
      this.handleMcpData(data);
    });

    this.mcpProcess.stderr?.on('data', (data: Buffer) => {
      logger.debug('[ax-glm MCP] Server stderr:', { output: data.toString() });
    });

    this.mcpProcess.on('error', (error) => {
      logger.error('[ax-glm MCP] Process error:', { error: error.message });
      this.connected = false;
    });

    this.mcpProcess.on('close', (code) => {
      logger.info(`[ax-glm MCP] Server process closed with code ${code}`);
      this.connected = false;
    });

    // Send initialize request
    const initResult = await this.sendRequest('initialize', {
      clientInfo: {
        name: 'ax-glm',
        version: '13.0.0'
      }
    });

    if (!initResult) {
      throw new Error('Failed to initialize MCP connection');
    }

    this.connected = true;
    logger.info('[ax-glm MCP] Connected to AutomatosX MCP server');
  }

  /**
   * Handle incoming data from MCP server
   */
  private handleMcpData(data: Buffer): void {
    this.responseBuffer += data.toString('utf-8');

    // Parse Content-Length framed messages
    while (true) {
      const delimiter = this.responseBuffer.includes('\r\n\r\n')
        ? '\r\n\r\n'
        : this.responseBuffer.includes('\n\n')
          ? '\n\n'
          : null;

      if (!delimiter) break;

      const headerEnd = this.responseBuffer.indexOf(delimiter);
      const headerBlock = this.responseBuffer.slice(0, headerEnd);
      const match = headerBlock.match(/Content-Length:\s*(\d+)/i);

      if (!match) break;

      const contentLength = parseInt(match[1] || '0', 10);
      const bodyStart = headerEnd + delimiter.length;

      if (this.responseBuffer.length < bodyStart + contentLength) break;

      const body = this.responseBuffer.slice(bodyStart, bodyStart + contentLength);
      this.responseBuffer = this.responseBuffer.slice(bodyStart + contentLength);

      try {
        const response = JSON.parse(body) as JsonRpcResponse;
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (error) {
        logger.error('[ax-glm MCP] Failed to parse response:', { error: (error as Error).message });
      }
    }
  }

  /**
   * Send MCP request and wait for response
   */
  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.mcpProcess?.stdin) {
      throw new Error('MCP connection not established');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      id,
      params
    };

    const json = JSON.stringify(request);
    const message = `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n${json}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 30000);

      this.mcpProcess!.stdin!.write(message, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(error);
        }
      });

      // Clear timeout on success
      this.pendingRequests.get(id)!.resolve = (value) => {
        clearTimeout(timeout);
        resolve(value);
      };
    });
  }

  /**
   * Call an MCP tool
   */
  private async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    }) as McpToolCallResult;

    if (result.isError) {
      const errorText = result.content[0]?.text || 'Unknown error';
      throw new Error(`MCP tool error: ${errorText}`);
    }

    const text = result.content[0]?.text;
    if (!text) {
      throw new Error('Empty MCP tool response');
    }

    return JSON.parse(text) as T;
  }

  /**
   * Chat with GLM, optionally using AutomatosX agent context
   */
  async chat(prompt: string, options: GlmMcpChatOptions = {}): Promise<ExecutionResponse> {
    if (!this.connected) {
      await this.connect();
    }

    let systemPrompt = '';

    // Get agent context if specified
    if (options.agent) {
      try {
        const context = await this.getAgentContext(options.agent, prompt, {
          includeMemory: options.includeMemory ?? true,
          maxMemoryResults: options.maxMemoryResults ?? 5
        });
        systemPrompt = context.enhancedPrompt;
        logger.debug('[ax-glm MCP] Loaded agent context', {
          agent: options.agent,
          memoryCount: context.memory.length
        });
      } catch (error) {
        logger.warn('[ax-glm MCP] Failed to load agent context:', { error: (error as Error).message });
      }
    }

    // Execute via GLM SDK directly
    const request: ExecutionRequest = {
      prompt,
      systemPrompt: systemPrompt || undefined
    };

    const response = await this.glmSdk.execute(request);

    // Save to memory if requested
    if (options.saveToMemory !== false) {
      try {
        await this.addMemory(response.content, {
          agent: options.agent,
          provider: 'glm',
          model: options.model || 'glm-4',
          task: prompt.substring(0, 200)
        });
      } catch (error) {
        logger.warn('[ax-glm MCP] Failed to save to memory:', { error: (error as Error).message });
      }
    }

    return response;
  }

  /**
   * List available agents from AutomatosX
   */
  async listAgents(): Promise<AgentInfo[]> {
    if (!this.connected) {
      await this.connect();
    }

    const result = await this.callTool<{ agents: AgentInfo[] }>('list_agents');
    return result.agents;
  }

  /**
   * Search AutomatosX memory
   */
  async searchMemory(query: string, limit = 10): Promise<MemoryEntry[]> {
    if (!this.connected) {
      await this.connect();
    }

    const result = await this.callTool<{ results: MemoryEntry[] }>('search_memory', {
      query,
      limit
    });
    return result.results;
  }

  /**
   * Add entry to AutomatosX memory
   */
  async addMemory(content: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    await this.callTool('memory_add', {
      content,
      metadata
    });
  }

  /**
   * Get agent context for a task
   */
  async getAgentContext(
    agent: string,
    task: string,
    options: { includeMemory?: boolean; maxMemoryResults?: number } = {}
  ): Promise<AgentContext> {
    if (!this.connected) {
      await this.connect();
    }

    return this.callTool<AgentContext>('get_agent_context', {
      agent,
      task,
      includeMemory: options.includeMemory ?? true,
      maxMemoryResults: options.maxMemoryResults ?? 5
    });
  }

  /**
   * Get AutomatosX system capabilities
   */
  async getCapabilities(): Promise<Record<string, unknown>> {
    if (!this.connected) {
      await this.connect();
    }

    return this.callTool('get_capabilities');
  }

  /**
   * Check if connected to MCP server
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.stdin?.end();
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
    await this.glmSdk.destroy();
    logger.info('[ax-glm MCP] Disconnected from AutomatosX');
  }
}
