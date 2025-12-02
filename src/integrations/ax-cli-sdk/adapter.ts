/**
 * AxCliSdkAdapter - SDK-based execution adapter (v10.4.0)
 *
 * Provides 10-40x performance improvement over CLI process spawning by
 * using the ax-cli SDK directly in-process.
 *
 * Performance characteristics:
 * - First call: ~50-100ms (agent initialization)
 * - Subsequent calls: ~5ms (direct function call)
 * - vs CLI: 50-200ms overhead per call
 *
 * New in v10.4.0:
 * - SubagentAdapter for parallel multi-agent execution
 * - CheckpointAdapter for resumable workflows
 * - InstructionsBridge for unified agent instructions
 *
 * @module integrations/ax-cli-sdk/adapter
 */

import type { AxCliAdapter, AxCliOptions } from '../ax-cli/interface.js';
import type { ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../utils/logger.js';
import { TokenEstimator } from './token-estimator.js';
import { SubagentAdapter, type SubagentTask, type SubagentResult, type OrchestratorOptions } from './subagent-adapter.js';
import { CheckpointAdapter, type Checkpoint, type Workflow, type CheckpointOptions } from './checkpoint-adapter.js';
import { InstructionsBridge, type CombinedInstructions, type InstructionsBridgeOptions, getInstructionsBridge } from './instructions-bridge.js';
import { AxCliMCPManager, getAxCliMCPManager, type MCPTemplate, type MCPServerConfig, type MCPManagerOptions } from './mcp-manager.js';

/**
 * SDK Adapter configuration options
 */
export interface SdkAdapterOptions {
  /** Reuse agent instances between calls (recommended for performance) */
  reuseEnabled?: boolean;

  /** Enable streaming events */
  streamingEnabled?: boolean;
}

/**
 * Agent configuration for tracking (SDK handles actual config via settings)
 */
interface AgentConfig {
  maxToolRounds: number;
}

/**
 * Adapter for ax-cli SDK (programmatic API)
 *
 * Features:
 * - In-process execution (no process spawning)
 * - Direct ExecutionResponse format (no parsing)
 * - Agent reuse for performance
 * - Streaming event support
 * - Automatic error mapping
 */
export class AxCliSdkAdapter implements AxCliAdapter {
  private agent: any = null;  // Will type as LLMAgent after import
  private agentConfig: AgentConfig | null = null;
  private readonly reuseEnabled: boolean;
  private readonly streamingEnabled: boolean;
  private sdkAvailable: boolean | null = null;

  // New adapters (v10.4.0)
  private subagentAdapter: SubagentAdapter | null = null;
  private checkpointAdapter: CheckpointAdapter | null = null;
  private instructionsBridge: InstructionsBridge | null = null;
  private mcpManager: AxCliMCPManager | null = null;

  constructor(options: SdkAdapterOptions = {}) {
    this.reuseEnabled = options.reuseEnabled ?? true;
    this.streamingEnabled = options.streamingEnabled ?? false;

    logger.debug('AxCliSdkAdapter initialized', {
      reuseEnabled: this.reuseEnabled,
      streamingEnabled: this.streamingEnabled
    });
  }

  // ==========================================
  // Subagent Orchestration (v10.4.0)
  // ==========================================

  /**
   * Get or create SubagentAdapter for parallel multi-agent execution
   *
   * @example
   * ```typescript
   * const subagents = adapter.getSubagentAdapter();
   * const results = await subagents.executeParallel([
   *   { task: 'Implement API', config: { role: 'developer' } },
   *   { task: 'Write tests', config: { role: 'tester' } }
   * ]);
   * ```
   */
  getSubagentAdapter(options?: OrchestratorOptions): SubagentAdapter {
    if (!this.subagentAdapter) {
      this.subagentAdapter = new SubagentAdapter(options);
      logger.debug('SubagentAdapter created');
    }
    return this.subagentAdapter;
  }

  /**
   * Execute multiple tasks in parallel using subagents
   * Convenience method that wraps SubagentAdapter.executeParallel()
   */
  async executeParallelTasks(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const adapter = this.getSubagentAdapter();
    return adapter.executeParallel(tasks);
  }

  /**
   * Execute tasks sequentially with context propagation
   * Convenience method that wraps SubagentAdapter.executeSequential()
   */
  async executeSequentialTasks(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const adapter = this.getSubagentAdapter();
    return adapter.executeSequential(tasks);
  }

  // ==========================================
  // Checkpoint/Resume Support (v10.4.0)
  // ==========================================

  /**
   * Get or create CheckpointAdapter for resumable workflows
   *
   * @example
   * ```typescript
   * const checkpoints = adapter.getCheckpointAdapter();
   * await checkpoints.save('my-workflow', { phase: 2, context: '...' });
   * const latest = await checkpoints.load('my-workflow');
   * ```
   */
  getCheckpointAdapter(options?: CheckpointOptions): CheckpointAdapter {
    if (!this.checkpointAdapter) {
      this.checkpointAdapter = new CheckpointAdapter(options);
      logger.debug('CheckpointAdapter created');
    }
    return this.checkpointAdapter;
  }

  /**
   * Save a checkpoint for a workflow
   * Convenience method that wraps CheckpointAdapter.save()
   */
  async saveCheckpoint(workflowId: string, data: Partial<Checkpoint>): Promise<Checkpoint> {
    const adapter = this.getCheckpointAdapter();
    return adapter.save(workflowId, data);
  }

  /**
   * Load the latest checkpoint for a workflow
   * Convenience method that wraps CheckpointAdapter.load()
   */
  async loadCheckpoint(workflowId: string): Promise<Checkpoint | null> {
    const adapter = this.getCheckpointAdapter();
    return adapter.load(workflowId);
  }

  /**
   * Check if a checkpoint exists and can be resumed
   */
  async canResumeWorkflow(workflowId: string): Promise<boolean> {
    const adapter = this.getCheckpointAdapter();
    return adapter.exists(workflowId);
  }

  /**
   * Get remaining phases for a workflow based on checkpoint
   */
  async getRemainingPhases(workflowId: string, workflow: Workflow): Promise<import('./checkpoint-adapter.js').WorkflowPhase[]> {
    const adapter = this.getCheckpointAdapter();
    return adapter.getRemainingPhases(workflowId, workflow);
  }

  // ==========================================
  // Instructions Bridge (v10.4.0)
  // ==========================================

  /**
   * Get or create InstructionsBridge for unified agent instructions
   *
   * @example
   * ```typescript
   * const bridge = adapter.getInstructionsBridge();
   * const instructions = await bridge.getInstructions('backend');
   * // instructions.systemPrompt contains merged agent + custom instructions
   * ```
   */
  getInstructionsBridge(options?: InstructionsBridgeOptions): InstructionsBridge {
    if (!this.instructionsBridge) {
      this.instructionsBridge = getInstructionsBridge(options);
      logger.debug('InstructionsBridge created');
    }
    return this.instructionsBridge;
  }

  /**
   * Get combined instructions for an agent
   * Convenience method that wraps InstructionsBridge.getInstructions()
   */
  async getAgentInstructions(agentName: string, additionalContext?: string): Promise<CombinedInstructions> {
    const bridge = this.getInstructionsBridge();
    return bridge.getInstructions(agentName, additionalContext);
  }

  /**
   * Sync an AutomatosX agent profile to ax-cli custom instructions
   */
  async syncAgentToAxCli(agentName: string): Promise<void> {
    const bridge = this.getInstructionsBridge();
    return bridge.syncAgentToAxCli(agentName);
  }

  // ==========================================
  // MCP Manager (v10.4.1)
  // ==========================================

  /**
   * Get or create MCP Manager for ax-cli MCP server management
   *
   * @example
   * ```typescript
   * const mcp = adapter.getMCPManager();
   * const templates = await mcp.getTemplateNames();
   * await mcp.addFromTemplate('github', { GITHUB_TOKEN: 'xxx' });
   * ```
   */
  getMCPManager(options?: MCPManagerOptions): AxCliMCPManager {
    if (!this.mcpManager) {
      this.mcpManager = getAxCliMCPManager(options);
      logger.debug('AxCliMCPManager created');
    }
    return this.mcpManager;
  }

  /**
   * Get all available MCP template names
   * Convenience method that wraps MCPManager.getTemplateNames()
   */
  async getMCPTemplateNames(): Promise<string[]> {
    const mcp = this.getMCPManager();
    const result = await mcp.getTemplateNames();
    return result.ok ? result.value : [];
  }

  /**
   * Get a specific MCP template
   * Convenience method that wraps MCPManager.getTemplate()
   */
  async getMCPTemplate(name: string): Promise<MCPTemplate | null> {
    const mcp = this.getMCPManager();
    const result = await mcp.getTemplate(name);
    return result.ok ? result.value : null;
  }

  /**
   * Add an MCP server from template
   * Convenience method that wraps MCPManager.addFromTemplate()
   */
  async addMCPFromTemplate(templateName: string, env?: Record<string, string>): Promise<boolean> {
    const mcp = this.getMCPManager();
    const result = await mcp.addFromTemplate(templateName, env);
    return result.ok;
  }

  /**
   * List all configured MCP servers
   * Convenience method that wraps MCPManager.listServers()
   */
  async listMCPServers(): Promise<string[]> {
    const mcp = this.getMCPManager();
    const result = await mcp.listServers();
    return result.ok ? result.value : [];
  }

  /**
   * Execute prompt via SDK
   *
   * Performance: ~5ms overhead vs ~50-200ms for CLI spawning
   */
  async execute(prompt: string, options: AxCliOptions): Promise<ExecutionResponse> {
    const startTime = Date.now();

    // Token tracking from SDK events
    let totalTokens = 0;

    try {
      // Ensure SDK is available
      if (!(await this.ensureSDKAvailable())) {
        throw new Error('ax-cli SDK not available. Install with: npm install @defai.digital/ax-cli');
      }

      // Initialize or recreate agent if config changed
      if (!this.agent || await this.hasConfigChanged(options)) {
        await this.initializeAgent(options);
      }

      logger.debug('Executing via SDK (streaming mode for token tracking)', {
        promptLength: prompt.length,
        userWantsCallbacks: !!(options.onStream || options.onTool),
        note: 'SDK handles custom instructions and project memory'
      });

      // Use streaming API internally (even if user doesn't want callbacks)
      // This is the ONLY way to get token counts from SDK

      // Get history length before execution (to identify new entries)
      const historyLengthBefore = this.agent.getChatHistory().length;

      for await (const chunk of this.agent.processUserMessageStream(prompt)) {
        // Track token counts from chunks
        if (chunk.type === 'token_count' && chunk.tokenCount) {
          totalTokens += chunk.tokenCount;
          logger.debug('Token count from stream', {
            count: chunk.tokenCount,
            total: totalTokens
          });
        }

        // Forward streaming callbacks if user wants them
        if (options.onStream && (chunk.type === 'content' || chunk.type === 'reasoning')) {
          try {
            options.onStream({
              type: chunk.type === 'reasoning' ? 'thinking' : 'content',
              content: chunk.content || chunk.reasoningContent,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            logger.warn('Stream callback error', {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        if (options.onTool && chunk.type === 'tool_calls' && chunk.toolCalls) {
          try {
            for (const toolCall of chunk.toolCalls) {
              options.onTool({
                name: toolCall.function.name,
                args: toolCall.function.arguments
              });
            }
          } catch (error) {
            logger.warn('Tool callback error', {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      // Get only the NEW entries from this execution
      const fullHistory = this.agent.getChatHistory();
      const result = fullHistory.slice(historyLengthBefore);

      logger.debug('Chat history extraction', {
        historyLengthBefore,
        historyLengthAfter: fullHistory.length,
        newEntries: result.length,
        entryTypes: result.map((e: any) => e.type)
      });

      // Validate we got a response
      if (result.length === 0) {
        logger.error('No new chat entries after execution', {
          historyLengthBefore,
          historyLengthAfter: fullHistory.length,
          fullHistory: fullHistory.map((e: any) => ({ type: e.type, content: e.content?.substring(0, 50) }))
        });
        throw new Error('SDK did not add any new chat entries. This may indicate an execution error.');
      }

      // Convert SDK response to ExecutionResponse format
      const response = this.convertToExecutionResponse(result, prompt, startTime, totalTokens);

      logger.info('SDK execution successful', {
        model: response.model,
        contentLength: response.content.length,
        tokensUsed: response.tokensUsed.total,
        latencyMs: response.latencyMs
      });

      return response;
    } catch (error) {
      logger.error('SDK execution failed', {
        error: error instanceof Error ? error.message : String(error),
        note: 'Model configured via ax-cli setup'
      });

      // Map SDK errors to AutomatosX error format
      throw this.mapError(error);
    }
  }

  /**
   * Initialize or reinitialize agent
   *
   * IMPORTANT: The SDK loads ALL credentials (API key, base URL, model) from
   * ~/.ax-cli/config.json which is created by running "ax-cli setup".
   *
   * We do NOT pass credentials to the SDK - it manages its own configuration.
   */
  private async initializeAgent(options: AxCliOptions): Promise<void> {
    // Dynamic import to avoid loading SDK unless needed
    const { createAgent } = await import('@defai.digital/ax-cli/sdk');

    try {
      const config: AgentConfig = {
        maxToolRounds: options.maxToolRounds || 400
      };

      logger.debug('Creating SDK agent (credentials from ax-cli settings)', {
        maxToolRounds: config.maxToolRounds,
        reuse: this.reuseEnabled,
        note: 'SDK loads apiKey, baseURL, model from ~/.ax-cli/config.json'
      });

      // Create agent via SDK
      // SDK will load apiKey, baseURL, model from ~/.ax-cli/config.json
      this.agent = await createAgent({
        maxToolRounds: config.maxToolRounds
      });

      this.agentConfig = config;

      // Set up event handlers if streaming enabled
      if (this.streamingEnabled) {
        this.setupEventHandlers();
      }

      logger.info('SDK agent initialized successfully', {
        maxToolRounds: config.maxToolRounds,
        note: 'Using credentials from ax-cli setup'
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Check for common setup issues in error message
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes('setup') || errorMsg.includes('not configured')) {
        logger.error('ax-cli setup required', {
          error: error.message,
          solution: 'Run: ax-cli setup'
        });
        throw new Error(
          'ax-cli setup has not been run. Please run "ax-cli setup" to configure your API key, model, and base URL. ' +
          `Original error: ${error.message}`
        );
      }

      if (errorMsg.includes('api key') || errorMsg.includes('apikey')) {
        logger.error('API key not configured', {
          error: error.message,
          solution: 'Run: ax-cli setup'
        });
        throw new Error(
          `No API key configured in ax-cli settings. Please run "ax-cli setup" to configure your credentials. Original error: ${error.message}`
        );
      }

      if (errorMsg.includes('base url') || errorMsg.includes('baseurl') || errorMsg.includes('endpoint')) {
        logger.error('Base URL not configured', {
          error: error.message,
          solution: 'Run: ax-cli setup'
        });
        throw new Error(
          `No base URL configured in ax-cli settings. Please run "ax-cli setup" to configure your AI provider endpoint. Original error: ${error.message}`
        );
      }

      // Generic error handling
      logger.error('Failed to initialize SDK agent', {
        error: error.message
      });
      throw new Error(`Failed to initialize SDK agent: ${error.message}`);
    }
  }

  /**
   * Check if agent config has changed (requires new agent)
   *
   * Since SDK manages credentials via settings, we only track maxToolRounds
   */
  private async hasConfigChanged(options: AxCliOptions): Promise<boolean> {
    if (!this.agentConfig) return true;

    const changed = this.agentConfig.maxToolRounds !== (options.maxToolRounds || 400);

    if (changed) {
      logger.debug('Agent config changed, will reinitialize', {
        oldMaxToolRounds: this.agentConfig.maxToolRounds,
        newMaxToolRounds: options.maxToolRounds || 400,
        note: 'SDK credentials managed by ax-cli setup'
      });
    }

    return changed;
  }

  /**
   * Set up streaming event handlers (for initialization)
   */
  private setupEventHandlers(): void {
    if (!this.agent) return;

    try {
      // SDK events: 'stream', 'tool', 'reasoning', etc.
      this.agent.on('stream', (chunk: any) => {
        logger.debug('Stream chunk received', {
          type: chunk.type,
          contentLength: chunk.content?.length
        });
      });

      this.agent.on('tool', (data: any) => {
        logger.debug('Tool invocation', {
          name: data.name
        });
      });

      this.agent.on('error', (error: Error) => {
        logger.error('Agent error event', {
          error: error.message
        });
      });
    } catch (error) {
      logger.warn('Failed to setup event handlers', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Set up streaming callbacks for execution
   */
  private setupStreamingCallbacks(options: AxCliOptions): void {
    if (!this.agent) return;

    try {
      // Remove any existing listeners to avoid duplicates
      this.agent.removeAllListeners('stream');
      this.agent.removeAllListeners('tool');

      // Set up stream callback if provided
      if (options.onStream) {
        this.agent.on('stream', (chunk: any) => {
          try {
            options.onStream!({
              type: chunk.type || 'content',
              content: chunk.content,
              tool: chunk.tool,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            logger.warn('Stream callback error', {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        });
      }

      // Set up tool callback if provided
      if (options.onTool) {
        this.agent.on('tool', (data: any) => {
          try {
            options.onTool!({
              name: data.name,
              args: data.args
            });
          } catch (error) {
            logger.warn('Tool callback error', {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        });
      }
    } catch (error) {
      logger.warn('Failed to setup streaming callbacks', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Convert SDK response to ExecutionResponse format
   *
   * SDK returns an array of chat entries:
   * [
   *   { type: "user", content: "...", timestamp: "..." },
   *   { type: "assistant", content: "...", timestamp: "..." }
   * ]
   *
   * Token usage priority: SDK events (totalTokens) > ChatEntry.usage > estimation fallback
   */
  private convertToExecutionResponse(result: any, prompt: string, startTime: number, totalTokensFromEvents: number = 0): ExecutionResponse {
    const latencyMs = Date.now() - startTime;

    // SDK returns array of chat entries
    if (Array.isArray(result)) {
      // Find the last assistant message
      const assistantMessages = result.filter((entry: any) => entry.type === 'assistant');

      if (assistantMessages.length === 0) {
        logger.error('No assistant message in result', {
          resultLength: result.length,
          entryTypes: result.map((e: any) => e.type),
          entries: result.map((e: any) => ({
            type: e.type,
            content: e.content?.substring(0, 100),
            hasToolCalls: !!e.toolCalls,
            hasToolResults: !!e.toolResult
          }))
        });
        throw new Error(`No assistant response found in SDK result. Got ${result.length} entries with types: ${result.map((e: any) => e.type).join(', ')}`);
      }

      // Get the last assistant message
      const lastAssistant = assistantMessages[assistantMessages.length - 1];
      const content = lastAssistant.content || '';

      // Token usage priority:
      // 1. From SDK events (token_count emissions) - most accurate
      // 2. From ChatEntry.usage - if available
      // 3. Estimation fallback

      let finalTokens;

      if (totalTokensFromEvents > 0) {
        // Use tokens from SDK events (100% accurate!)
        // SDK emits input tokens first, then output tokens incrementally
        // We can't split them accurately, so use estimation for split
        const estimated = TokenEstimator.estimateUsage(prompt, content);
        finalTokens = {
          prompt: estimated.prompt,  // Estimated split
          completion: estimated.completion,  // Estimated split
          total: totalTokensFromEvents  // Actual total from events
        };

        logger.info('Using token count from SDK events', {
          tokens: TokenEstimator.format(finalTokens),
          accuracy: '100% (total), 80-90% (split)',
          source: 'token_count events'
        });
      } else {
        // Fallback: Try to extract from ChatEntry.usage (if SDK adds it)
        const usage = lastAssistant.usage || lastAssistant.tokens || {};
        const actualTokens = {
          prompt: usage.prompt_tokens || usage.prompt || usage.input || usage.promptTokens || 0,
          completion: usage.completion_tokens || usage.completion || usage.output || usage.completionTokens || 0,
          total: usage.total_tokens || usage.total || usage.totalTokens || 0
        };

        const hasActualTokens = actualTokens.total > 0;

        if (hasActualTokens) {
          finalTokens = {
            prompt: actualTokens.prompt,
            completion: actualTokens.completion,
            total: actualTokens.total
          };

          logger.info('Using token counts from ChatEntry.usage', {
            tokens: TokenEstimator.format(finalTokens),
            accuracy: '100%',
            source: 'ChatEntry.usage'
          });
        } else {
          // Last resort: estimation
          finalTokens = TokenEstimator.estimateUsage(prompt, content);

          logger.warn('SDK did not provide token counts, using estimation', {
            tokens: TokenEstimator.format(finalTokens, true),
            accuracy: '80-90% (estimated)',
            source: 'estimation'
          });
        }
      }

      // Get model name from agent (ChatEntry doesn't have model field)
      const model = this.agent!.getCurrentModel();

      // ChatEntry doesn't have finishReason field, use 'stop' as default
      // SDK will terminate with 'stop' for normal completion
      const finishReason: 'stop' | 'length' | 'error' = 'stop';

      return {
        content,
        model,
        tokensUsed: finalTokens,
        latencyMs,
        finishReason,
        cached: false  // SDK doesn't expose cache status via ChatEntry
      };
    }

    // Fallback: single response object (if SDK API changes)
    const content = typeof result === 'string' ? result : result.content || result.text || '';

    let finalTokens;

    if (totalTokensFromEvents > 0) {
      // Use tokens from SDK events
      const estimated = TokenEstimator.estimateUsage(prompt, content);
      finalTokens = {
        prompt: estimated.prompt,
        completion: estimated.completion,
        total: totalTokensFromEvents
      };

      logger.info('Using token count from SDK events (fallback path)', {
        tokens: TokenEstimator.format(finalTokens),
        accuracy: '100% (total), 80-90% (split)',
        source: 'token_count events'
      });
    } else {
      // Try to extract from response.usage
      const usage = result.usage || result.tokens || {};
      const actualTokens = {
        prompt: usage.prompt_tokens || usage.prompt || usage.input || usage.promptTokens || 0,
        completion: usage.completion_tokens || usage.completion || usage.output || usage.completionTokens || 0,
        total: usage.total_tokens || usage.total || usage.totalTokens || 0
      };

      const hasActualTokens = actualTokens.total > 0;

      if (hasActualTokens) {
        finalTokens = {
          prompt: actualTokens.prompt,
          completion: actualTokens.completion,
          total: actualTokens.total
        };

        logger.info('Using token counts from response.usage (fallback path)', {
          tokens: TokenEstimator.format(finalTokens),
          accuracy: '100%',
          source: 'response.usage'
        });
      } else {
        // Last resort: estimation
        finalTokens = TokenEstimator.estimateUsage(prompt, content);

        logger.warn('SDK did not provide token counts (fallback path), using estimation', {
          tokens: TokenEstimator.format(finalTokens, true),
          accuracy: '80-90% (estimated)',
          source: 'estimation'
        });
      }
    }

    // Get model name from agent (fallback path)
    const model = this.agent!.getCurrentModel();

    // Default to 'stop' finish reason (fallback path)
    const finishReason: 'stop' | 'length' | 'error' = 'stop';

    return {
      content,
      model,
      tokensUsed: finalTokens,
      latencyMs,
      finishReason,
      cached: false  // SDK doesn't expose cache status
    };
  }

  /**
   * Map SDK errors to AutomatosX error types
   */
  private mapError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error(`SDK error: ${String(error)}`);
    }

    const message = error.message.toLowerCase();

    // Map common SDK errors
    if (message.includes('rate limit') || message.includes('rate_limit')) {
      const mappedError = new Error(`Rate limit exceeded: ${error.message}`);
      (mappedError as any).code = 'RATE_LIMIT_EXCEEDED';
      return mappedError;
    }

    if (message.includes('context length') || message.includes('max_tokens')) {
      const mappedError = new Error(`Context length exceeded: ${error.message}`);
      (mappedError as any).code = 'CONTEXT_LENGTH_EXCEEDED';
      return mappedError;
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      const mappedError = new Error(`Request timeout: ${error.message}`);
      (mappedError as any).code = 'TIMEOUT';
      return mappedError;
    }

    if (message.includes('invalid api key') || message.includes('authentication')) {
      const mappedError = new Error(`Authentication failed: ${error.message}`);
      (mappedError as any).code = 'AUTHENTICATION_FAILED';
      return mappedError;
    }

    if (message.includes('network') || message.includes('econnrefused')) {
      const mappedError = new Error(`Network error: ${error.message}`);
      (mappedError as any).code = 'NETWORK_ERROR';
      return mappedError;
    }

    // Pass through other errors
    return error;
  }

  /**
   * Ensure SDK is available
   */
  private async ensureSDKAvailable(): Promise<boolean> {
    if (this.sdkAvailable !== null) {
      return this.sdkAvailable;
    }

    try {
      // Try to import SDK
      await import('@defai.digital/ax-cli/sdk');
      this.sdkAvailable = true;
      logger.debug('SDK is available');
      return true;
    } catch (error) {
      this.sdkAvailable = false;
      logger.warn('SDK not available', {
        error: error instanceof Error ? error.message : String(error),
        hint: 'Run: npm install @defai.digital/ax-cli'
      });
      return false;
    }
  }

  /**
   * Check if SDK is available
   */
  async isAvailable(): Promise<boolean> {
    return await this.ensureSDKAvailable();
  }

  /**
   * Get SDK version
   */
  async getVersion(): Promise<string> {
    try {
      // Try to import SDK to check if it's available
      await import('@defai.digital/ax-cli/sdk');
      // SDK doesn't expose version directly, return expected version
      return '3.14.5+';
    } catch (error) {
      logger.warn('Failed to get SDK version', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 'unknown';
    }
  }

  /**
   * Get command name (for compatibility with AxCliAdapter interface)
   */
  getCommand(): string {
    return 'ax-cli-sdk';
  }

  /**
   * Get display name
   */
  getDisplayName(): string {
    return 'ax-cli (SDK)';
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    // Cleanup main agent
    if (this.agent) {
      try {
        // Call SDK's dispose() method to cleanup resources
        // This cleans up event listeners, caches, terminates subagents, etc.
        this.agent.dispose();

        this.agent = null;
        this.agentConfig = null;

        logger.debug('SDK agent destroyed');
      } catch (error) {
        logger.warn('Error during agent cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Cleanup SubagentAdapter (v10.4.0)
    if (this.subagentAdapter) {
      try {
        await this.subagentAdapter.destroy();
        this.subagentAdapter = null;
        logger.debug('SubagentAdapter destroyed');
      } catch (error) {
        logger.warn('Error during SubagentAdapter cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Cleanup CheckpointAdapter (v10.4.0)
    if (this.checkpointAdapter) {
      try {
        this.checkpointAdapter.destroy();
        this.checkpointAdapter = null;
        logger.debug('CheckpointAdapter destroyed');
      } catch (error) {
        logger.warn('Error during CheckpointAdapter cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Cleanup InstructionsBridge cache (v10.4.0)
    if (this.instructionsBridge) {
      try {
        this.instructionsBridge.clearCache();
        this.instructionsBridge = null;
        logger.debug('InstructionsBridge cache cleared');
      } catch (error) {
        logger.warn('Error during InstructionsBridge cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Cleanup MCP Manager (v10.4.1)
    if (this.mcpManager) {
      this.mcpManager = null;
      logger.debug('MCP Manager cleared');
    }
  }
}

// Re-export types for convenience
export type {
  SubagentTask,
  SubagentResult,
  OrchestratorOptions,
  Checkpoint,
  Workflow,
  CheckpointOptions,
  CombinedInstructions,
  InstructionsBridgeOptions,
  MCPTemplate,
  MCPServerConfig,
  MCPManagerOptions
};

// Re-export MCP manager
export { AxCliMCPManager, getAxCliMCPManager, resetAxCliMCPManager } from './mcp-manager.js';
