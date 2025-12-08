/**
 * ax-grok MCP Client Mode
 *
 * Enables ax-grok to connect to AutomatosX MCP server for:
 * - Service discovery (agents, tools, capabilities)
 * - Memory search and persistence
 * - Smart routing context retrieval
 *
 * v13.0.0: Added as part of PRD MCP Architecture Redesign.
 *
 * @module integrations/ax-grok/mcp-client-mode
 */

import { spawn, type ChildProcess } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../../shared/logging/logger.js';
import type { ExecutionRequest, ExecutionResponse } from '../../types/provider.js';
import { GrokSdkAdapter } from './sdk-adapter.js';
import type { GrokModel } from './types.js';

/**
 * MCP configuration for ax-grok
 * Read from .ax-grok/mcp-config.json if available
 */
interface GrokMcpConfig {
  mcp: {
    enabled: boolean;
    serverCommand: string;
    serverArgs: string[];
    autoConnect: boolean;
    timeout: number;
  };
  provider: {
    name: string;
    apiKeyEnv: string;
    defaultModel: string;
  };
  integration: {
    useMemory: boolean;
    useAgentContext: boolean;
    saveResponsesToMemory: boolean;
  };
}

/**
 * Claude Code format .mcp.json structure
 * v12.3.0: New format created by ax setup
 */
interface ClaudeCodeMcpJson {
  mcpServers: {
    [key: string]: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
}

/**
 * Load MCP config from .ax-grok/.mcp.json (v12.3.0+) or .ax-grok/mcp-config.json (legacy)
 *
 * Priority order:
 * 1. .ax-grok/.mcp.json (Claude Code format - recommended, created by ax setup v12.3.0+)
 * 2. .ax-grok/mcp-config.json (legacy format)
 */
function loadGrokMcpConfig(): GrokMcpConfig | null {
  // v12.3.0: First try Claude Code format (.mcp.json)
  const claudeCodeConfigPaths = [
    join(process.cwd(), '.ax-grok', '.mcp.json'),
    join(process.env.HOME || '', '.ax-grok', '.mcp.json')
  ];

  for (const configPath of claudeCodeConfigPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const claudeConfig = JSON.parse(content) as ClaudeCodeMcpJson;

        // Convert Claude Code format to GrokMcpConfig
        const automatosxServer = claudeConfig.mcpServers?.['automatosx'];
        if (automatosxServer) {
          const config: GrokMcpConfig = {
            mcp: {
              enabled: true,
              serverCommand: automatosxServer.command,
              serverArgs: automatosxServer.args || ['mcp', 'server'],
              autoConnect: true,
              timeout: 30000
            },
            provider: {
              name: 'grok',
              apiKeyEnv: 'XAI_API_KEY',
              defaultModel: 'grok-3'
            },
            integration: {
              useMemory: true,
              useAgentContext: true,
              saveResponsesToMemory: true
            }
          };
          logger.debug('[ax-grok MCP] Loaded Claude Code format config from', { path: configPath });
          return config;
        }
      } catch (error) {
        logger.warn('[ax-grok MCP] Failed to parse .mcp.json', { path: configPath, error: (error as Error).message });
      }
    }
  }

  // Fallback to legacy format (mcp-config.json)
  const legacyConfigPaths = [
    join(process.cwd(), '.ax-grok', 'mcp-config.json'),
    join(process.env.HOME || '', '.ax-grok', 'mcp-config.json')
  ];

  for (const configPath of legacyConfigPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content) as GrokMcpConfig;
        logger.debug('[ax-grok MCP] Loaded legacy config from', { path: configPath });
        return config;
      } catch (error) {
        logger.warn('[ax-grok MCP] Failed to parse legacy config', { path: configPath, error: (error as Error).message });
      }
    }
  }

  return null;
}

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
 * Chat options for ax-grok with MCP integration
 */
export interface GrokMcpChatOptions {
  /** Agent to use (loads context from AutomatosX) */
  agent?: string;
  /** Model to use (default: grok-3) */
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
 * ax-grok with MCP client integration
 *
 * Connects to AutomatosX MCP server for orchestration while using
 * Grok SDK directly for execution (no CLI indirection).
 *
 * **Usage:**
 * ```typescript
 * const grok = new AxGrokWithMcp();
 * await grok.connect();
 *
 * // Discover agents
 * const agents = await grok.listAgents();
 *
 * // Chat with agent context
 * const response = await grok.chat('Analyze security vulnerabilities', {
 *   agent: 'security',
 *   saveToMemory: true
 * });
 * ```
 */
export class AxGrokWithMcp {
  private mcpProcess: ChildProcess | null = null;
  private grokSdk: GrokSdkAdapter;
  private connected = false;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private responseBuffer = '';
  private config: GrokMcpConfig | null = null;

  constructor(options: { model?: GrokModel; apiKey?: string } = {}) {
    // Load MCP config from .ax-grok/mcp-config.json
    this.config = loadGrokMcpConfig();

    this.grokSdk = new GrokSdkAdapter({
      model: options.model,
      apiKey: options.apiKey
    });

    if (this.config) {
      logger.info('[ax-grok MCP] Config loaded', {
        enabled: this.config.mcp.enabled,
        serverCommand: this.config.mcp.serverCommand
      });
    }
  }

  /**
   * Connect to AutomatosX MCP server
   * Uses config from .ax-grok/mcp-config.json if available
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Check if MCP is enabled in config
    if (this.config && !this.config.mcp.enabled) {
      logger.info('[ax-grok MCP] MCP disabled in config, skipping connection');
      return;
    }

    logger.info('[ax-grok MCP] Connecting to AutomatosX MCP server...');

    // Use config or defaults
    const serverCommand = this.config?.mcp.serverCommand || 'automatosx';
    const serverArgs = this.config?.mcp.serverArgs || ['mcp', 'server'];

    // Spawn MCP server process
    this.mcpProcess = spawn(serverCommand, serverArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Set up response handling
    this.mcpProcess.stdout?.on('data', (data: Buffer) => {
      this.handleMcpData(data);
    });

    this.mcpProcess.stderr?.on('data', (data: Buffer) => {
      logger.debug('[ax-grok MCP] Server stderr:', { output: data.toString() });
    });

    this.mcpProcess.on('error', (error) => {
      logger.error('[ax-grok MCP] Process error:', { error: error.message });
      this.connected = false;
    });

    this.mcpProcess.on('close', (code) => {
      logger.info(`[ax-grok MCP] Server process closed with code ${code}`);
      this.connected = false;
    });

    // Send initialize request
    const initResult = await this.sendRequest('initialize', {
      clientInfo: {
        name: 'ax-grok',
        version: '13.0.0'
      }
    });

    if (!initResult) {
      throw new Error('Failed to initialize MCP connection');
    }

    this.connected = true;
    logger.info('[ax-grok MCP] Connected to AutomatosX MCP server');
  }

  /**
   * Handle incoming data from MCP server
   *
   * v12.2.0: Changed from Content-Length to newline-delimited framing
   * per official MCP specification
   */
  private handleMcpData(data: Buffer): void {
    this.responseBuffer += data.toString('utf-8');

    // Parse newline-delimited messages (official MCP spec)
    while (true) {
      const newlineIndex = this.responseBuffer.indexOf('\n');
      if (newlineIndex === -1) break;

      // Extract the message (strip trailing \r if present for Windows compatibility)
      let jsonMessage = this.responseBuffer.slice(0, newlineIndex);
      if (jsonMessage.endsWith('\r')) {
        jsonMessage = jsonMessage.slice(0, -1);
      }
      this.responseBuffer = this.responseBuffer.slice(newlineIndex + 1);

      // Skip empty lines
      if (jsonMessage.trim() === '') continue;

      try {
        const response = JSON.parse(jsonMessage) as JsonRpcResponse;
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
        logger.error('[ax-grok MCP] Failed to parse response:', { error: (error as Error).message });
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

    // v12.2.0: Use newline-delimited framing per MCP spec
    const json = JSON.stringify(request);
    const message = json + '\n';

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
   * Chat with Grok, optionally using AutomatosX agent context
   */
  async chat(prompt: string, options: GrokMcpChatOptions = {}): Promise<ExecutionResponse> {
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
        logger.debug('[ax-grok MCP] Loaded agent context', {
          agent: options.agent,
          memoryCount: context.memory.length
        });
      } catch (error) {
        logger.warn('[ax-grok MCP] Failed to load agent context:', { error: (error as Error).message });
      }
    }

    // Execute via Grok SDK directly
    const request: ExecutionRequest = {
      prompt,
      systemPrompt: systemPrompt || undefined
    };

    const response = await this.grokSdk.execute(request);

    // Save to memory if requested
    if (options.saveToMemory !== false) {
      try {
        await this.addMemory(response.content, {
          agent: options.agent,
          provider: 'grok',
          model: options.model || 'grok-3',
          task: prompt.substring(0, 200)
        });
      } catch (error) {
        logger.warn('[ax-grok MCP] Failed to save to memory:', { error: (error as Error).message });
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
    await this.grokSdk.destroy();
    logger.info('[ax-grok MCP] Disconnected from AutomatosX');
  }
}
